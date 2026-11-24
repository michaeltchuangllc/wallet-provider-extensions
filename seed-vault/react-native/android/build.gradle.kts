plugins {
  id("com.android.library")
  id("expo-module-gradle-plugin")
}

group = "com.algorandfoundation.seedvault"
version = "0.0.0"

android {
  namespace = "com.algorandfoundation.seedvault"
  lint {
    abortOnError = false
  }
}

repositories {
  // mavenLocal()
  mavenCentral()
}

dependencies {
  // Published from seed-vault-service with:
  //   ./gradlew :seed-vault-sdk:publishToMavenLocal -PsignAllPublications=false \
  //     -PmavenCentralPublishing=false -x javaDocReleaseGeneration
  api("com.michaeltchuang.algokit.seedvault:seed-vault-sdk:0.0.4")
  // Solana Mobile Seed Vault wallet SDK.
  api("com.solanamobile:seedvault-wallet-sdk:0.4.0")
}

// The SDK is built with Kotlin 2.4; the host app compiles with an older compiler.
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
  compilerOptions.freeCompilerArgs.add("-Xskip-metadata-version-check")
}
