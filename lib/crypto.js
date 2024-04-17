/**
 * Using Crypto functions of the browser without any npm dependencies
 * @link https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 * @link https://blog.elantha.com/encrypt-in-the-browser/ 
 */

const LENGTH_OF_SALT = 16;
const LENGTH_OF_IV   = 12;

/**
 * @summary encrypt content with a password into a triple of salt, iv and cipher,
 *          composing a single Uint8Array from all three parts
 * @param {Uint8Array} content - text to be encrypted
 * @param {String} password - text used as password 
 * @returns {Uint8Array} result - concatenate salt, iv and cipher text
 * 
 * The salt is effectively a random number which is used when deriving the encryption key 
 * from the password. Without a random element the derived key will always be the same for 
 * any particular password and this would give a potential hacker an advantage. This does mean 
 * that the same salt value must be available when decrypting, that's why the salt needs to 
 * be stored alongside the encrypted cipher data. 
 * 
 * Likewise the iv performs a similar role when using the key to encrypt the content. 
 * Without a random element the same key and content will always generate the same encrypted 
 * cipher data - again this would make a hacker's life much easier.
 */
async function encrypt(content, password) {
  if ( ! password ) password = getPassword();
  
  /** {Uint8Array(16)} salt */
  const salt = crypto.getRandomValues(new Uint8Array(LENGTH_OF_SALT));

  const key = await getKey(password, salt);

  /** {Uint8Array(12)} iv */
  const iv = crypto.getRandomValues(new Uint8Array(LENGTH_OF_IV));

  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, content )
  );

  return mergeUint8Arrays( salt, iv, cipher );

}

/**
 * @summary decrypt the encryptedData containing salt, iv and cipher with the help of a password
 * @param {Uint8Array} encryptedData - containg salt, iv and cipher
 * @param {String} password - text used as password 
 * @returns {Uint8Array} result - original text before encrypting
 * @throws {DOMException} exception - if password is wrong or input too short
 */
async function decrypt(encryptedData, password) {
  if ( ! password ) password = getPassword();

  // decompose all three parts from single input Uint8Array
  const salt = encryptedData.slice(0, LENGTH_OF_SALT);
  const iv = encryptedData.slice(LENGTH_OF_SALT, LENGTH_OF_SALT + LENGTH_OF_IV);
  const cipher = encryptedData.slice(LENGTH_OF_SALT + LENGTH_OF_IV);
  
  const key = await getKey(password, salt);

  const content = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher.buffer);
  // throws Exception, if password is wrong
  // DOMException: The provided data is too small, code = 0, 'The provided data is too small' 'OperationError'
  return content;
}

/**
 * @summary 
 * @param {String} password 
 * @param {Uint8Array(16)} salt 
 * @returns {CryptoKey} result - key derived from password
 */
async function getKey(password, salt) {
  const passwordBytes = stringToBytes(password);

  const initialKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    initialKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  /** {CryptoKey} derivedKey */
  return derivedKey; 
}

// conversion helpers

function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToBase64(arr) {
  return btoa(Array.from(arr, (b) => String.fromCharCode(b)).join(""));
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function getPassword(){
  return document.querySelector('.password')?.value || prompt('Passwort?');
}

function mergeUint8Arrays( ...myArrays ){
  // Get the total length of all arrays.
  const length = myArrays.reduce((sum,anArray)=>{sum+=anArray.length; return sum},0);

  // Create a new array with total length and merge all source arrays.
  const mergedArray = new Uint8Array(length);
  let offset = 0;
  myArrays.forEach(item => {
    mergedArray.set(item, offset);
    offset += item.length;
  });

  return mergedArray;
}


export { encrypt, decrypt, stringToBytes, bytesToString };