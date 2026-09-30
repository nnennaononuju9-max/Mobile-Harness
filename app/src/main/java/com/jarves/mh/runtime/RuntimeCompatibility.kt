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
        osArchitecture.equals("aarch64", ignoreCase = true) ||
        osArchitecture.equals("arm64", ignoreCase = true)

    val hasArm64Abi = supportedAbis.any {
        it.equals("arm64-v8a", ignoreCase = true)
    }

    return kernelIsArm64 && hasArm64Abi
}
