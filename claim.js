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
async function sendRequest(method, url, logType) {
  const headers = {
    Authorization: `Bearer ${BEARER_TOKEN}`,
  };

  try {
    const response = await axios({ method, url, headers });
	console.log(`Successful for ${url}`);
    appendLog(`[${logType}] Successful for ${url}`);
    return response;
  } catch (error) {
    const errorDetails = error.response?.data || 'No additional details';
    appendLog(`[${logType}] Failed for ${url}: ${error.message} - ${errorDetails}`);
    console.error(`[${logType}] Failed for ${url}: ${error.message}`.red);
  }
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
async function doClaim(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = await wallet.getAddress();
  try {
    await sendRequest('options', `https://be.rivalz.ai/api-v1/auth/get-blog-subscription-point`, 'OPTIONS');
    await sendRequest('get', `https://be.rivalz.ai/api-v1/auth/get-blog-subscription-point`, 'GET');
	await delay(2000);
    await sendRequest('options', `https://be.rivalz.ai/api-v1/auth/get-reward-quest-history`, 'OPTIONS');
    await sendRequest('get', `https://be.rivalz.ai/api-v1/auth/get-reward-quest-history`, 'GET');
	await delay(2000);
    await sendRequest('options', `https://api.rivalz.ai/fragment/v1/badges/checkAnswer/7/DEPIN202409109049ZNODEAGENTsteganography`, 'OPTIONS');
    await sendRequest('get', `https://api.rivalz.ai/fragment/v1/badges/checkAnswer/7/DEPIN202409109049ZNODEAGENTsteganography`, 'GET');
	await delay(5000);
    await sendRequest('options', `https://api.rivalz.ai/fragment/v1/badges/claim/${address}/9`, 'OPTIONS Claim');
    await sendRequest('post', `https://api.rivalz.ai/fragment/v1/badges/claim/${address}/9`, 'POST Claim');
	await delay(5000);
    await sendRequest('options', `https://api.rivalz.ai/fragment/v1/badges/claim/${address}/8`, 'OPTIONS Claim');
    await sendRequest('post', `https://api.rivalz.ai/fragment/v1/badges/claim/${address}/8`, 'POST Claim');
	await delay(2000);
  } catch (error) {
    const errorMessage = `Error executing Claim Badge: ${error.message}`;
    console.log(errorMessage.red);
    appendLog(errorMessage);
  }
}
async function runClaim() {
	for (const PRIVATE_KEY of PRIVATE_KEYS) {
		try {
			await doClaim(PRIVATE_KEY);
			await getFragPoint(PRIVATE_KEY);
		} catch (error) {
			const errorMessage = `Error processing Claim. Details: ${error.message}`;
			console.log(errorMessage.red);
			console.log(error);
		}
	}
}
runClaim();
