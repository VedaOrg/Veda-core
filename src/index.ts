import { config } from 'dotenv'
import BvmRpcClient from './bvm-client'
import initUpdater from './updater'

config()
const bvmRpcClient = new BvmRpcClient(process.env.BVM_RPC_URL || '')
const init = async () => {
  let genesisBlock = 820500
  try {
    return (await bvmRpcClient.getSyncInfo()).result!.veda_block_number
  } catch(e) {
    return genesisBlock
  }
}

(async () => {
  const progress = await init()
  await initUpdater(progress)
})()