package com.jarves.mh.runtime

import android.content.Context
import com.jarves.mh.model.ChatMessage
import com.jarves.mh.model.ChangeItem
import com.jarves.mh.model.ProjectKind
import com.jarves.mh.model.ProviderProfile
import com.jarves.mh.model.RuntimeEvent
import com.jarves.mh.model.ToolRequest
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject

internal sealed interface MiniParsedEvent {
    data class Text(val value: String) : MiniParsedEvent
    data class ToolStarted(val name: String, val detail: String) : MiniParsedEvent
    data class ToolCompleted(val name: String, val detail: String) : MiniParsedEvent
    data class Result(val status: String, val response: String?, val error: String?) : MiniParsedEvent
}

internal object MiniEventParser {
    fun parse(line: String): MiniParsedEvent? {
        val root = runCatching { JSONObject(line) }.getOrNull() ?: return null
        return when (root.optString("event")) {
            "text" -> MiniParsedEvent.Text(root.optString("value"))
            "tool_started" -> MiniParsedEvent.ToolStarted(root.optString("name"), root.optString("detail"))
            "tool_completed" -> MiniParsedEvent.ToolCompleted(root.optString("name"), root.optString("detail"))
            "result" -> MiniParsedEvent.Result(
                root.optString("status", "ERROR"),
                root.optString("response").takeIf(String::isNotBlank),
                root.optString("error").takeIf(String::isNotBlank),
            )
            else -> null
        }
    }
}

class MiniSweAgentException(message: String) : Exception(message)

class MiniSweAgentRuntimeBridge(
    private val context: Context,
    private val model: () -> String,
    private val secretFor: (ProviderProfile) -> String?,
) : RuntimeBridge {
    private val installer = RuntimeInstaller(context)
    private val checkpoints = WorkspaceCheckpoints(context.filesDir)
    private val eventBus = MutableSharedFlow<RuntimeEvent>(extraBufferCapacity = 64)
    override val events: Flow<RuntimeEvent> = eventBus
    @Volatile private var activeProcess: Process? = null
    @Volatile private var userStopRequested = false

    fun configureProjectRoot(projectId: String, rootPath: String) = checkpoints.configureProjectRoot(projectId, rootPath)

    override suspend fun startSession(
        projectId: String,
        projectSlug: String,
        projectKind: ProjectKind,
        prompt: String,
        conversationHistory: List<ChatMessage>,
        provider: ProviderProfile,
    ): String = withContext(Dispatchers.IO + NonCancellable) {
        val sessionId = UUID.randomUUID().toString()
        userStopRequested = false
        eventBus.emit(RuntimeEvent.SessionStarted(sessionId))

        if (!installer.isAgentInstalled(com.jarves.mh.model.AgentKind.MINI_SWE_AGENT)) {
            eventBus.emit(RuntimeEvent.SessionFailed(sessionId, "mini-swe-agent is not installed. Open Settings → Coding agent to install it."))
            return@withContext sessionId
        }

        val secret = secretFor(provider).orEmpty()
        if (secret.isBlank()) {
            eventBus.emit(RuntimeEvent.SessionFailed(sessionId, "No API key is saved for ${provider.kind.title}."))
            return@withContext sessionId
        }

        runCatching {
            RuntimeTaskController.stopAction = {
                userStopRequested = true
                activeProcess?.destroy()
            }
            val installed = installer.installedRuntime()
            val workspace = checkpoints.ensureWorkspace(projectId)
            checkpoints.createCheckpoint(projectId, workspace)
            // Must be captured before the agent runs, immediately after the checkpoint backup is made.
            val before = checkpoints.snapshot(workspace)

            // Same env-building path ClaudeRuntimeBridge uses — resolves the real
            // ANTHROPIC_API_KEY/base-url/etc. for whichever provider is configured,
            // instead of hand-rolling a map here.
            val launch = RuntimeLaunchConfigBuilder.build(
                provider,
                authToken = secret,
                localGatewayUrl = null,
            )

            val command = listOf("python3", "/usr/local/bin/mini_bridge.py")
            val process = installer.process(
                installed.proot,
                installed.rootfs,
                workspace,
                launch.environment,
                command,
                guestWorkspacePath = "/workspace/$projectSlug",
                emulateHardLinks = false,
            )
            activeProcess = process
            if (userStopRequested) process.destroy()

            val request = JSONObject()
                .put("message", JSONObject().put("content", prompt))
                .put("model", model())
                .put("workdir", "/workspace/$projectSlug")
                .toString() + "\n"
            process.outputStream.write(request.toByteArray())
            process.outputStream.flush()
            process.outputStream.close()

            val native = process as? NativeSpawnProcess ?: error("Unsupported mini-swe-agent process")
            var offset = 0L
            val pending = StringBuilder()
            var resultSeen = false

            suspend fun handleLine(line: String) {
                when (val event = MiniEventParser.parse(line)) {
                    is MiniParsedEvent.Text -> eventBus.emit(RuntimeEvent.AssistantDelta(sessionId, event.value))
                    is MiniParsedEvent.ToolStarted -> eventBus.emit(RuntimeEvent.ToolStarted(sessionId, event.name, event.detail))
                    is MiniParsedEvent.ToolCompleted -> eventBus.emit(RuntimeEvent.ToolCompleted(sessionId, event.name, event.detail))
                    is MiniParsedEvent.Result -> {
                        if (event.status.equals("SUCCESS", ignoreCase = true)) {
                            resultSeen = true
                        } else throw MiniSweAgentException(event.error ?: "mini-swe-agent failed")
                    }
                    null -> Unit
                }
            }

            while (process.isAlive || native.outputFile.length() > offset) {
                val available = native.outputFile.length() - offset
                if (available <= 0) { delay(50); continue }
                val bytes = ByteArray(minOf(available, 16L * 1024).toInt())
                val count = RandomAccessFile(native.outputFile, "r").use { f -> f.seek(offset); f.read(bytes) }
                if (count <= 0) continue
                offset += count
                pending.append(bytes.decodeToString(0, count))
                var newline = pending.indexOf("\n")
                while (newline >= 0) {
                    val line = pending.substring(0, newline).trimEnd('\r')
                    pending.delete(0, newline + 1)
                    handleLine(line)
                    newline = pending.indexOf("\n")
                }
            }
            withContext(NonCancellable) { runCatching { process.waitFor() } }

            // Computed after the run, against the pre-run snapshot captured above.
            val changedPaths = checkpoints.changedFiles(workspace, before)
            if (changedPaths.isNotEmpty()) {
                checkpoints.saveChangedPaths(projectId, changedPaths)
                val changes = checkpoints.buildChangeDetails(projectId, workspace, changedPaths)
                eventBus.emit(RuntimeEvent.FilesChanged(sessionId, changes))
            }

            if (resultSeen) eventBus.emit(RuntimeEvent.SessionCompleted(sessionId))
            else eventBus.emit(RuntimeEvent.SessionFailed(sessionId, "mini-swe-agent ended without a result"))
        }.onFailure { e ->
            eventBus.emit(RuntimeEvent.SessionFailed(sessionId, e.message ?: "mini-swe-agent failed"))
        }
        sessionId
    }

    override suspend fun respondToApproval(request: ToolRequest, approved: Boolean) {
        // mini-swe-agent runs with no interactive approval step — nothing to respond to.
    }

    override suspend fun stopSession(sessionId: String) {
        userStopRequested = true
        activeProcess?.destroy()
    }

    override suspend fun stopActiveSession() {
        userStopRequested = true
        activeProcess?.destroy()
    }

    override suspend fun undoLastChanges(projectId: String): Boolean {
        val workspace = checkpoints.ensureWorkspace(projectId)
        val backup = File(checkpoints.checkpointDir(projectId), "project")
        val paths = checkpoints.readChangedPaths(projectId)
        if (paths.isEmpty()) return false
        paths.forEach { path ->
            val backupFile = checkpoints.safeWorkspaceFile(backup, path)
            val workspaceFile = checkpoints.safeWorkspaceFile(workspace, path)
            if (backupFile.isFile) {
                workspaceFile.parentFile?.mkdirs()
                backupFile.copyTo(workspaceFile, overwrite = true)
            } else {
                workspaceFile.delete() // file didn't exist before the session — undo removes it
            }
        }
        checkpoints.checkpointDir(projectId).deleteRecursively()
        return true
    }

    override suspend fun acceptLastChanges(projectId: String) {
        // Accepting means keeping the current files as-is — just clear the pending list.
        checkpoints.checkpointDir(projectId).deleteRecursively()
    }

    override suspend fun loadPendingChanges(projectId: String): List<ChangeItem> {
        val workspace = checkpoints.ensureWorkspace(projectId)
        val paths = checkpoints.readChangedPaths(projectId)
        return checkpoints.buildChangeDetails(projectId, workspace, paths)
    }

    override suspend fun undoFileChange(projectId: String, path: String): Boolean {
        val workspace = checkpoints.ensureWorkspace(projectId)
        val backup = File(checkpoints.checkpointDir(projectId), "project")
        val backupFile = checkpoints.safeWorkspaceFile(backup, path)
        val workspaceFile = checkpoints.safeWorkspaceFile(workspace, path)
        if (backupFile.isFile) {
            workspaceFile.parentFile?.mkdirs()
            backupFile.copyTo(workspaceFile, overwrite = true)
        } else {
            workspaceFile.delete()
        }
        checkpoints.removeChangedPath(projectId, path)
        return true
    }

    override suspend fun acceptFileChange(projectId: String, path: String): Boolean {
        checkpoints.removeChangedPath(projectId, path)
        return true
    }
}
