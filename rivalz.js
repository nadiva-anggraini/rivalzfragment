const { ethers } = require('ethers');
const chains = require('./chains');
const provider = chains.testnet.rivalzTestnet.provider();
const explorer = chains.testnet.rivalzTestnet.explorer;
const fs = require('fs');
const moment = require('moment-timezone');
const axios = require('axios');
const { displayHeader, delay } = require('./chains/utils/utils');
const PRIVATE_KEYS = JSON.parse(fs.readFileSync('privateKeys.json', 'utf-8'));
const { RIVALZ_ABI } = require('./abi/abi');
const CLAIM_CA = '0xF0a66d18b46D4D5dd9947914ab3B2DDbdC19C2C0';
function getBearerToken() {
  try {
    return fs.readFileSync('bearer.txt', 'utf-8').trim();
  } catch (error) {
    console.error('Cannot Read Bearer Token from bearer.txt:', error.message.red);
    process.exit(1);
  }
}
const BEARER_TOKEN = getBearerToken();

function appendLog(message) {
  fs.appendFileSync('log.txt', message + '\n');
}

/**
 * Utility function to handle HTTP requests with logging.
 * @param {string} method - HTTP method ('get', 'post', 'options').
 * @param {string} url - Request URL.
 * @param {string} logType - Log identifier.
 */
function timestamp() {
  return moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY');
}
async function getFragPoint(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  const url = `https://be.rivalz.ai/api-v1/orbit-db/total-node-info/${address}`;
  try {
    const response = await axios.get(url);
    if (response.data && response.data.data) {
      const fragPoint = response.data.data.fragPoint;
      console.log(`Address: ${address}, AG Points: ${fragPoint}`.green);
    } else {
      console.error('Data format unexpected or missing.'.red);
    }
  } catch (error) {
    console.error(`Failed to fetch fragPoint for ${address}: ${error.message}`.red);
  }
}
async function sendRequest(method, url, logType) {
  const headers = {
    Authorization: `Bearer ${BEARER_TOKEN}`,
  };

  try {
    const response = await axios({ method, url, headers });
    appendLog(`[${logType}] Successful for ${url}`);
    return response;
  } catch (error) {
    const errorDetails = error.response?.data || 'No additional details';
    appendLog(`[${logType}] Failed for ${url}: ${error.message} - ${errorDetails}`);
    console.error(`[${logType}] Failed for ${url}: ${error.message}`.red);
  }
}

async function doClaim(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  try {
    const gasLimit = 300000;
    const claimContract = new ethers.Contract(
      CLAIM_CA,
      RIVALZ_ABI,
      wallet
    );
    const txClaim = await claimContract.claim({
      gasLimit: gasLimit,
    });
    const receipt = await txClaim.wait(1);
    const successMessage = `Transaction Confirmed in block ${receipt.blockNumber}`;
    console.log(successMessage.blue);
    appendLog(successMessage);
    await sendRequest('options', `https://api.rivalz.ai/fragment/v2/fragmentz-v2/balance/${address}`, 'OPTIONS Balance');
    await sendRequest('options', `https://api.rivalz.ai/fragment/v2/fragmentz-v2/claim/${txClaim.hash}`, 'OPTIONS Claim');
    await sendRequest('get', `https://api.rivalz.ai/fragment/v2/fragmentz-v2/balance/${address}`, 'GET Balance');
    await sendRequest('post', `https://api.rivalz.ai/fragment/v2/fragmentz-v2/claim/${txClaim.hash}`, 'POST Claim');

    return txClaim.hash;
  } catch (error) {
    const errorMessage = `Error executing transaction: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
}

async function runClaim() {
  displayHeader();

  if (!Array.isArray(PRIVATE_KEYS) || PRIVATE_KEYS.length === 0) {
    console.error('No private keys found in privateKeys.json.'.red);
    process.exit(1);
  }

  while (true) {
    for (const PRIVATE_KEY of PRIVATE_KEYS) {
      try {
        for (let i = 0; i < 20; i++) {
          const timezone = moment().tz('Asia/Jakarta').format('HH:mm:ss [WIB] DD-MM-YYYY');
          await delay(5000);
          const receiptTx = await doClaim(PRIVATE_KEY);

          if (receiptTx) {
            const successMessage = `[${timezone}] Transaction Hash: ${explorer.tx(receiptTx)} (${i + 1}/20)`;
            await delay(5000);
            console.log(successMessage.cyan);
            appendLog(successMessage);
          }

          await getFragPoint(PRIVATE_KEY);
          console.log('');
        }
      } catch (error) {
        const errorMessage = `[${timestamp()}] Error processing transaction: ${error.message}`;
        console.log(errorMessage.red);
        appendLog(errorMessage);
        console.log('');
      }
    }
    appendLog('');
    console.log('Waiting for 12 hours for next claiming...'.yellow);
    await delay(12 * 60 * 60 * 1000);
  }
}
runClaim();
