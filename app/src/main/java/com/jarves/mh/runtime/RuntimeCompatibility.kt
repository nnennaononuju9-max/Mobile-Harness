package com.jarves.mh.runtime

/**
 * Mobile Harness currently targets 32-bit ARM devices.
 *
 * Android ABI: armeabi-v7a
 * Linux architecture: armv7l / arm
 */
fun supportsArm32Runtime(
    supportedAbis: Array<String>,
    @Suppress("UNUSED_PARAMETER") osArchitecture: String,
): Boolean {
    // This build targets armeabi-v7a only (not a dual 32/64-bit build), so the
    // device's reported ABI list is what actually determines which native code
    // the OS will run. os.arch is not used: it reports the underlying chip's
    // instruction set, which does not reliably match "armv7l"/"arm" even on
    // devices that only expose the armeabi-v7a ABI to apps.
    return supportedAbis.any {
        it.equals("armeabi-v7a", ignoreCase = true) ||
        it.equals("armeabi", ignoreCase = true)
    }
}

/**
 * Returns true when the Android device and Linux environment support ARM64.
 *
 * Android ABI: arm64-v8a
 * Linux architecture: aarch64 / arm64
 */
fun supportsArm64Runtime(
    supportedAbis: Array<String>,
    osArchitecture: String?,
): Boolean {
    val kernelIsArm64 =
        osArchitecture.equals("armv7l", ignoreCase = true) ||
        osArchitecture.equals("arm", ignoreCase = true)

    val hasArm64Abi = supportedAbis.any {
        it.equals("armeabi-v7a", ignoreCase = true)
    }

    return kernelIsArm64 && hasArm64Abi
}
