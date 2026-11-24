package com.algorandfoundation.seedvault

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Base64
import com.michaeltchuang.seedvault.sdk.SeedVaultServiceConstants
import com.michaeltchuang.seedvault.sdk.client.SeedVaultServiceClient
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine

/**
 * Bridges the Seed Vault Service client from seed-vault-sdk to JS. Binary values cross the
 * bridge as base64 (no wrap). The `confirm*` and `authorizeApp` calls open the Seed Vault app and
 * resolve `true` on RESULT_OK; the signing and derivation calls need that approval first.
 */
class ReactNativeSeedVaultModule : Module() {
  private var client: SeedVaultServiceClient? = null
  private var pendingPromise: Promise? = null

  private fun requireClient(): SeedVaultServiceClient {
    client?.let { return it }
    val context = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React context is not available")
    return SeedVaultServiceClient(context).also { client = it }
  }

  private fun decode(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

  private fun encode(value: ByteArray?): String? = value?.let { Base64.encodeToString(it, Base64.NO_WRAP) }

  private fun launch(intent: Intent, promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("ERR_NO_ACTIVITY", "No foreground activity to open Algorand Seed Vault from", null)
      return
    }
    // Replace any stale pending request rather than leaking it.
    pendingPromise?.resolve(false)
    pendingPromise = promise
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (t: Throwable) {
      pendingPromise = null
      promise.reject("ERR_LAUNCH", t.message ?: "Could not open Algorand Seed Vault", t)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ReactNativeSeedVault")

    Constants(
      "PACKAGE" to SeedVaultServiceConstants.PACKAGE,
      "DERIVE_DOMAIN_PREFIX" to SeedVaultServiceConstants.DERIVE_DOMAIN_PREFIX,
      "DERIVE_MIN_LENGTH" to SeedVaultServiceConstants.DERIVE_MIN_LENGTH,
      "DERIVE_MAX_LENGTH" to SeedVaultServiceConstants.DERIVE_MAX_LENGTH,
      "MAX_BATCH_TRANSACTIONS" to SeedVaultServiceConstants.MAX_BATCH_TRANSACTIONS,
    )

    Function("isInstalled") {
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      try {
        pm.getPackageInfo(SeedVaultServiceConstants.PACKAGE, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    Function("isConnected") { client?.isConnected() ?: false }

    AsyncFunction("bind") Coroutine { ->
      requireClient().bindAsync().isServiceReady
    }

    Function("unbind") {
      client?.unbind()
      null
    }

    AsyncFunction("getAuthorizedSeeds") {
      requireClient().getAuthorizedSeeds().map { seed ->
        mapOf(
          "id" to seed.id.toDouble(),
          "name" to seed.name,
          "accounts" to seed.accounts.map { account ->
            mapOf(
              "index" to account.index,
              "address" to account.address,
              "publicKey" to account.publicKey,
              "isAutosign" to account.isAutosign,
              "requiresApproval" to account.requiresApproval,
              "supportsKeyDerivation" to account.supportsKeyDerivation,
            )
          },
        )
      }
    }

    AsyncFunction("signBytes") { address: String, data: String ->
      encode(requireClient().signBytes(address, decode(data)))
    }

    AsyncFunction("signTransaction") { address: String, transaction: String ->
      encode(requireClient().signTransaction(address, decode(transaction)))
    }

    AsyncFunction("deriveKeyMaterial") { address: String, domain: String, info: String, length: Int ->
      encode(requireClient().deriveKeyMaterial(address, domain, decode(info), length))
    }

    AsyncFunction("authorizeApp") { promise: Promise ->
      launch(requireClient().authorizeAppIntent(), promise)
    }

    AsyncFunction("confirmSignBytes") { address: String, data: String, promise: Promise ->
      launch(requireClient().confirmSignBytesIntent(address, decode(data)), promise)
    }

    AsyncFunction("confirmSignTransaction") { address: String, transaction: String, promise: Promise ->
      launch(requireClient().confirmSignTransactionIntent(address, decode(transaction)), promise)
    }

    AsyncFunction("confirmSignTransactions") { address: String, transactions: List<String>, promise: Promise ->
      launch(requireClient().confirmSignTransactionsIntent(address, transactions.map(::decode)), promise)
    }

    AsyncFunction("confirmDeriveKeyMaterial") { address: String, domain: String, info: String, length: Int, promise: Promise ->
      launch(requireClient().confirmDeriveKeyMaterialIntent(address, domain, decode(info), length), promise)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null
      promise.resolve(payload.resultCode == Activity.RESULT_OK)
    }

    OnDestroy {
      client?.unbind()
      client = null
    }
  }

  private companion object {
    const val REQUEST_CODE = 0x5EED
  }
}
