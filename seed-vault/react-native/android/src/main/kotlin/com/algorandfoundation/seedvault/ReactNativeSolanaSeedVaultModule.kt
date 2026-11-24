package com.algorandfoundation.seedvault

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Base64
import com.solanamobile.seedvault.SigningRequest
import com.solanamobile.seedvault.Wallet
import com.solanamobile.seedvault.WalletContractV1
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Bridges the Solana Mobile Seed Vault wallet SDK (`com.solanamobile.seedvault.Wallet`) to JS.
 * Binary values cross the bridge as base64 (no wrap). Account addresses are the base58 public keys
 * the Seed Vault reports. Every flow that opens the Seed Vault UI resolves from onActivityResult.
 */
class ReactNativeSolanaSeedVaultModule : Module() {
  private var pending: ((resultCode: Int, data: Intent?) -> Unit)? = null
  private var pendingReject: ((String, String) -> Unit)? = null

  private val context
    get() = appContext.reactContext?.applicationContext
      ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)

  private fun decode(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

  private fun encode(value: ByteArray): String = Base64.encodeToString(value, Base64.NO_WRAP)

  /** Opens the Seed Vault and hands the raw result to [onResult], replacing any stale request. */
  private fun launch(
    intent: Intent,
    promise: Promise,
    onResult: (resultCode: Int, data: Intent?) -> Any?,
  ) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("ERR_NO_ACTIVITY", "No foreground activity to open Seed Vault from", null)
      return
    }
    pendingReject?.invoke("ERR_SUPERSEDED", "Superseded by a newer Seed Vault request")
    pendingReject = { code, message -> promise.reject(code, message, null) }
    pending = { resultCode, data ->
      try {
        promise.resolve(onResult(resultCode, data))
      } catch (e: Wallet.ActionFailedException) {
        promise.reject("ERR_SEED_VAULT_ACTION", e.message ?: "Seed Vault action failed", e)
      } catch (t: Throwable) {
        promise.reject("ERR_SEED_VAULT", t.message ?: "Seed Vault request failed", t)
      }
    }
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
    } catch (t: Throwable) {
      pending = null
      pendingReject = null
      promise.reject("ERR_LAUNCH", t.message ?: "Could not open Seed Vault", t)
    }
  }

  private fun findAccount(address: String): Pair<Long, Uri>? {
    val ctx = context
    val seeds = Wallet.getAuthorizedSeeds(ctx, arrayOf(WalletContractV1.AUTHORIZED_SEEDS_AUTH_TOKEN))
    val tokens = mutableListOf<Long>()
    seeds?.use { while (it.moveToNext()) tokens.add(it.getLong(0)) }
    for (token in tokens) {
      val cursor = Wallet.getAccounts(
        ctx,
        token,
        arrayOf(
          WalletContractV1.ACCOUNTS_BIP32_DERIVATION_PATH,
          WalletContractV1.ACCOUNTS_PUBLIC_KEY_ENCODED,
        ),
        WalletContractV1.ACCOUNTS_PUBLIC_KEY_ENCODED,
        address,
      )
      cursor?.use {
        if (it.moveToNext()) return token to Uri.parse(it.getString(0))
      }
    }
    return null
  }

  private fun signingIntent(address: String, payload: String, isMessage: Boolean): Intent {
    val (authToken, path) = findAccount(address)
      ?: throw CodedException("ERR_UNKNOWN_ACCOUNT", "No authorized Seed Vault account matches $address", null)
    val requests = arrayListOf(SigningRequest(decode(payload), listOf(path)))
    return if (isMessage) {
      Wallet.signMessages(context, authToken, requests)
    } else {
      Wallet.signTransactions(context, authToken, requests)
    }
  }

  private fun signatureOf(
    resultCode: Int,
    data: Intent?,
    isMessage: Boolean,
  ): String? {
    if (resultCode == Activity.RESULT_CANCELED) return null
    val responses = if (isMessage) {
      Wallet.onSignMessagesResult(resultCode, data)
    } else {
      Wallet.onSignTransactionsResult(resultCode, data)
    }
    val signature = responses.singleOrNull()?.signatures?.singleOrNull()
      ?: throw IllegalStateException("Seed Vault must return exactly one signature")
    return encode(signature)
  }

  override fun definition() = ModuleDefinition {
    Name("ReactNativeSolanaSeedVault")

    Constants(
      "PERMISSION" to "com.solanamobile.seedvault.ACCESS_SEED_VAULT",
      "PURPOSE_SIGN_SOLANA_TRANSACTION" to WalletContractV1.PURPOSE_SIGN_SOLANA_TRANSACTION,
    )

    Function("isInstalled") {
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      try {
        pm.getPackageInfo("com.solanamobile.seedvaultimpl", 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    Function("hasUnauthorizedSeeds") {
      try {
        Wallet.hasUnauthorizedSeedsForPurpose(context, WalletContractV1.PURPOSE_SIGN_SOLANA_TRANSACTION)
      } catch (e: SecurityException) {
        false
      }
    }

    AsyncFunction("getAuthorizedSeeds") Coroutine { ->
      withContext(Dispatchers.IO) {
        val ctx = context
        val cursor = try {
          Wallet.getAuthorizedSeeds(ctx, WalletContractV1.AUTHORIZED_SEEDS_ALL_COLUMNS)
        } catch (e: SecurityException) {
          throw CodedException("ERR_PERMISSION", "ACCESS_SEED_VAULT permission not granted", e)
        } catch (e: IllegalStateException) {
          throw CodedException("ERR_UNAVAILABLE", "Seed Vault is not available on this device", e)
        }
        val seeds = mutableListOf<Pair<Long, String>>()
        cursor?.use {
          val tokenIdx = it.getColumnIndexOrThrow(WalletContractV1.AUTHORIZED_SEEDS_AUTH_TOKEN)
          val nameIdx = it.getColumnIndexOrThrow(WalletContractV1.AUTHORIZED_SEEDS_SEED_NAME)
          while (it.moveToNext()) seeds.add(it.getLong(tokenIdx) to it.getString(nameIdx))
        }
        seeds.map { (authToken, name) ->
          val accounts = mutableListOf<Map<String, Any?>>()
          Wallet.getAccounts(
            ctx,
            authToken,
            WalletContractV1.ACCOUNTS_ALL_COLUMNS,
            WalletContractV1.ACCOUNTS_ACCOUNT_IS_USER_WALLET,
            "1",
          )?.use {
            val idIdx = it.getColumnIndexOrThrow(WalletContractV1.ACCOUNTS_ACCOUNT_ID)
            val pathIdx = it.getColumnIndexOrThrow(WalletContractV1.ACCOUNTS_BIP32_DERIVATION_PATH)
            val keyIdx = it.getColumnIndexOrThrow(WalletContractV1.ACCOUNTS_PUBLIC_KEY_ENCODED)
            val nameIdx = it.getColumnIndexOrThrow(WalletContractV1.ACCOUNTS_ACCOUNT_NAME)
            while (it.moveToNext()) {
              accounts.add(
                mapOf(
                  "id" to it.getLong(idIdx).toDouble(),
                  "address" to it.getString(keyIdx),
                  "name" to it.getString(nameIdx),
                  "derivationPath" to it.getString(pathIdx),
                ),
              )
            }
          }
          mapOf(
            "authToken" to authToken.toDouble(),
            "name" to name,
            "accounts" to accounts,
          )
        }
      }
    }

    AsyncFunction("authorizeSeed") { promise: Promise ->
      launch(
        Wallet.authorizeSeed(context, WalletContractV1.PURPOSE_SIGN_SOLANA_TRANSACTION),
        promise,
      ) { resultCode, data -> Wallet.onAuthorizeSeedResult(resultCode, data).toDouble() }
    }

    AsyncFunction("signMessage") { address: String, message: String, promise: Promise ->
      val intent = signingIntent(address, message, isMessage = true)
      launch(intent, promise) { resultCode, data -> signatureOf(resultCode, data, isMessage = true) }
    }

    AsyncFunction("signTransaction") { address: String, transaction: String, promise: Promise ->
      val intent = signingIntent(address, transaction, isMessage = false)
      launch(intent, promise) { resultCode, data -> signatureOf(resultCode, data, isMessage = false) }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val handler = pending ?: return@OnActivityResult
      pending = null
      pendingReject = null
      handler(payload.resultCode, payload.data)
    }

    OnDestroy {
      pendingReject?.invoke("ERR_DESTROYED", "Seed Vault module was destroyed")
      pending = null
      pendingReject = null
    }
  }

  private companion object {
    const val REQUEST_CODE = 0x501A
  }
}
