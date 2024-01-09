import { config } from 'dotenv'
import BvmRpcClient from './bvm-client'
import initUpdater from './updater'

config()
const bvmRpcClient = new BvmRpcClient(process.env.BVM_RPC_URL || '')
const init = async () => {
  let genesisBlock = 822267
  let timestamp = 1703181793

  return {
    lastBlockHeight: 822478,
    lastTimestamp: timestamp,
  }
  try {
    const syncInfo = await bvmRpcClient.getSyncInfo()
    return {
      lastBlockHeight: syncInfo.result!.veda_block_number,
      lastTimestamp: syncInfo.result!.veda_timestamp,
    }
  } catch (e) {
    return {
      lastBlockHeight: genesisBlock,
      lastTimestamp: timestamp,
    }
  }
}

(async () => {
  const { lastBlockHeight, lastTimestamp } = await init()
  await initUpdater(lastBlockHeight, lastTimestamp)
})()