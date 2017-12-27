// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview A general-purpose cache for user credentials in the form of
 * a Uint8Array.
 */

/**
 * A general-purpose cache for user credentials in the form of a Uint8Array.
 *
 * The data in the cache is encrypted at rest using a random Web Crypto AES-CBC
 * key.
 *
 * Security considerations:
 *
 * - The cache is only used by the current Secure Shell window and
 * cleared when the screen locks.
 * - Data in the cache is encrypted using a random Web Crypto AES-CBC
 * key configured to be non-extractable and a randomly generated IV for
 * every encryption operation.
 * - Since the Web Crypto spec does not require non-extractable keys to be
 * kept in a secure hardware element or protected memory, a leak of
 * memory contents should realistically be considered equivalent to a
 * full compromise.
 * - Malicious servers can abuse the caching behavior for e.g. user passwords
 * and smart card PINs if the user has agent forwarding enabled.
 *
 * @constructor
 */
lib.CredentialCache = function() {
  /**
   * The underlying cache. Keys are strings and the cache entries consist of the
   * encrypted data and the initialization vector (IV) used for the AES
   * encryption in CBC mode.
   *
   * @member {?Object<!string, {encryptedData: !Uint8Array, iv: !Uint8Array}>>}
   * @private
   */
  this.cache_ = null;

  /**
   * The Web Crypto API AES-CBC CryptoKey that has been used to encrypt the data
   * in the cache. The key is randomly generated during initialization or after
   * the cache has been cleared.
   *
   * @member {?CryptoKey}
   * @private
   */
  this.cryptoKey_ = null;

  /**
   * Set to true if caching is enabled; false if caching is disabled and null if
   * the user has not yet made a decision.
   *
   * @member {?boolean}
   * @private
   */
  this.enabled_ = null;

  // Clear the cache on screen lock.
  if (window.chrome && chrome.idle) {
    chrome.idle.onStateChanged.addListener((state) => {
      if (state === 'locked') {
        this.clear_();
      }
    });
  }
};

/**
 * Initialize the cache and generate a new, non-extractable encryption key.
 *
 * @returns {!Promise.<void>}
 * @private
 */
lib.CredentialCache.prototype.init_ = async function() {
  this.cache_ = {};
  this.cryptoKey_ = await window.crypto.subtle.generateKey(
      {name: 'AES-CBC', length: 128}, false, ['encrypt', 'decrypt']);
};

/**
 * Clear the cache and delete the reference to the encryption key.
 *
 * @private
 */
lib.CredentialCache.prototype.clear_ = function() {
  this.cache_ = null;
  this.cryptoKey_ = null;
  this.enabled_ = null;
};

/**
 * Retrieve the cached data for the given key string.
 *
 * Note: The data bytes in the returned Uint8Array should be overwritten after
 * use.
 *
 * Note: In order to ensure consistency, upon successful retrieval the cached
 * data is deleted and should be added again after its validity has been
 * verified.
 *
 * @param {!string} key The key to which the corresponding data should be
 *     looked up.
 * @returns {Promise.<?Uint8Array>} The data bytes if the key is present in the
 *     cache; null otherwise.
 */
lib.CredentialCache.prototype.retrieve = async function(key) {
  if (!this.cache_) {
    await this.init_();
  }
  if (key in this.cache_) {
    const {encryptedData, iv} = this.cache_[key];
    // Remove cache entry to be added again only if data verification succeeds.
    delete this.cache_[key];
    return new Uint8Array(await window.crypto.subtle.decrypt(
        {name: 'AES-CBC', iv}, this.cryptoKey_, encryptedData));
  }
  return null;
};

/**
 * Store the data in the cache under the given key.
 *
 * Note: The provided data array is overwritten with zeroes after the data has
 * been added to the cache.
 *
 * @param {!string} key The key under which the data should be stored in the
 *     cache.
 * @param {!Uint8Array} data The data bytes to be stored.
 * @returns {Promise.<void>}
 */
lib.CredentialCache.prototype.store = async function(key, data) {
  if (!this.cache_) {
    await this.init_();
  }
  // AES-CBC requires a new, cryptographically random IV for every operation.
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const encryptedData = await window.crypto.subtle.encrypt(
      {name: 'AES-CBC', iv}, this.cryptoKey_, data.buffer);
  data.fill(0);
  this.cache_[key] = {encryptedData, iv};
};

/**
 * Check whether caching is enabled.
 *
 * @returns {?boolean} True if the user enabled caching; false if the user
 *     disabled caching; null if the user has not made a decision yet.
 */
lib.CredentialCache.prototype.isEnabled = function() {
  return this.enabled_;
};

/**
 * Enable or disable caching.
 *
 * Note: Caching can only be enabled or disabled once.
 *
 * @param {!boolean} enable
 */
lib.CredentialCache.prototype.setEnabled = function(enable) {
  if (this.enabled_ === null) {
    this.enabled_ = enable;
  }
};
