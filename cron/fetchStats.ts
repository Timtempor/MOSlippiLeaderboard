import { getPlayerDataThrottled } from './slippi'
import { GoogleSpreadsheet } from 'google-spreadsheet';
import creds from '../secrets/co-melee-77b97a2696c1.json';
import * as syncFs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
const fs = syncFs.promises;

const getPlayerConnectCodes = async (): Promise<string[]> => {
  const doc = new GoogleSpreadsheet('1DPIFD0RUA3yjruregmFUbUJ7ccdOjVB2LBp0goHvL-A');
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0];
  const rows = (await sheet.getRows()).slice(1); // remove header row
  return [...new Set(rows.map((r) => r._rawData[1]).filter(r => r !== ''))] as string[]
};

const getPlayers = async () => {
  const codes = await getPlayerConnectCodes()
  const allData = codes.map(code => getPlayerDataThrottled(code))
  const results = await Promise.all(allData.map(p => p.catch(e => e)));
  const validResults = results.filter(result => !(result instanceof Error));
  const unsortedPlayers = validResults
    .filter((data: any) => data?.data?.getConnectCode?.user)
    .map((data: any) => data.data.getConnectCode.user);
  return unsortedPlayers.sort((p1, p2) =>
    p2.rankedNetplayProfile.ratingOrdinal - p1.rankedNetplayProfile.ratingOrdinal)
}

async function main() {
  console.log('Starting player fetch.');
  const players = await getPlayers();
  console.log('Player fetch complete.');
  // rename original to players-old
  const newFile = path.join(__dirname, 'data/players-new.json')
  const oldFile = path.join(__dirname, 'data/players-old.json')
  const timestamp = path.join(__dirname, 'data/timestamp.json')

  await fs.rename(newFile, oldFile)
  console.log('Renamed existing data file.');
  await fs.writeFile(newFile, JSON.stringify(players));
  await fs.writeFile(timestamp, JSON.stringify({updated: Date.now()}));
  console.log('Wrote new data file and timestamp.');
  console.log('Deploying.');
  exec('npm run deploy');
}

main();