package com.jarves.mh.runtime

/**
 * Mobile Harness currently targets 32-bit ARM devices.
 *
 * Android ABI: armeabi-v7a
 * Linux architecture: armv7l / arm
 */
fun supportsArm32Runtime(
    supportedAbis: Array<String>,
    osArchitecture: String,
): Boolean {
    val kernelIsArm32 =
        osArchitecture.equals("armv7l", ignoreCase = true) ||
        osArchitecture.equals("arm", ignoreCase = true)

    val hasArm32Abi = supportedAbis.any {
        it.equals("armeabi-v7a", ignoreCase = true) ||
        it.equals("armeabi", ignoreCase = true)
    }

    return kernelIsArm32 && hasArm32Abi
}
