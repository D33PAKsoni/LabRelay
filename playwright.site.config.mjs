import {defineConfig} from '@playwright/test';
const baseURL=process.env.LABRELAY_SITE_URL;
if(!baseURL||!baseURL.startsWith('https://'))throw Error('Set LABRELAY_SITE_URL to the verified Appwrite Sites HTTPS URL.');
export default defineConfig({testDir:'./tests/hosted-site',workers:1,timeout:180000,expect:{timeout:30000},
 reporter:[['list'],['json',{outputFile:'reports/hosted-site-results.json'}]],
 use:{baseURL,headless:true,viewport:{width:1440,height:1000},launchOptions:process.env.LABRELAY_BROWSER_EXECUTABLE?{executablePath:process.env.LABRELAY_BROWSER_EXECUTABLE}:{}}});
