import axios from 'axios'
import { Contract } from 'web3'
import Progress from 'progress'
import RLP from 'rlp'
import { keccak256 } from 'web3-utils'
import { config } from 'dotenv'
import { autoRetry } from '../utils'
import verifyMessage from '../verifier'
import { publicKeyToAddress, generateHexAddress, generateContractAddress } from '../address'
import BitcoinRpcClient from '../bitcoin-client'
import BvmRpcClient, { Transaction } from '../bvm-client'
interface ContractInscription {
  bytecode?: string
  abi?: string
}

interface Instruction {
  p?: string
  publicKey?: string
  txHash?: string
  addressType?: 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr'
  action?: 'execute' | 'deploy'
  contract?: string
  bytecodeLocation?: string
  nonce?: number
  data?: string
  sigType?: 'ecdsa' | 'bip-322'
  sig?: string
}
type FilteredInstruction = {
  [P in keyof Instruction as Exclude<P, 'contract' | 'bytecodeLocation'>]-?: Instruction[P]
} & Pick<Instruction, 'contract' | 'bytecodeLocation'>
interface DeploySerialInstruction extends Required<Omit<Instruction, 'txHash' | 'action' | 'contract' | 'sig'>> {
  action: 'deploy'
}
interface ExecuteSerialInstruction extends Required<Omit<Instruction, 'txHash' | 'action' | 'bytecodeLocation' | 'sig'>> {
  action: 'execute'
}

interface InscriptionEntry {
  charms: number
  fee: number
  height: number
  id: string
  inscription_number: number
  parent: number | null
  sat: number | null
  sequence_number: number
  timestamp: number
}

interface BlockInfo {
  block_count: number
  inscriptions: Array<{
    entry: InscriptionEntry
    content: string
  }>
}
config()
// Clients
const bitcoinRpcClient = new BitcoinRpcClient({
  url: process.env.BITCOIND_RPC_URL || '',
  user: process.env.BITCOIND_RPC_USER || '',
  password: process.env.BITCOIND_RPC_PASSWORD || '',
})
// const web3 = new Web3('')
const bvmRpcClient = new BvmRpcClient(process.env.BVM_RPC_URL || '')

const getRequest = async <T>(params: string | number, path: string, delay: number = Math.floor(Math.random() * (100 - 10 + 1)) + 10) => {
  const data = await autoRetry(async () => {
    return (await axios.get<T>(`${process.env.ORD_URL}/${path}/${params}`)).data
  }, {
    timeout: 0,
    delay,
    errorHandler: error => {
      if (error.response && Math.floor(error.response.status / 100) === 4) {
        return true
      } else {
        // console.error('Something wrong when requesting inscription')
        return false
      }
    }
  })

  return data
}

const getBlock = async (height: number) => {
  const inscriptionInfo = await getRequest<BlockInfo>(height, 'api/inscriptions/block')
  return inscriptionInfo
}

const getInscriptionContent = async <T>(inscriptionId: string) => {
  const inscriptionContent = await getRequest<T>(inscriptionId, 'content')
  return inscriptionContent
}

const isValidABI = (abi: string) => {
  try {
    new Contract(JSON.parse(abi))
    return true
  } catch (error) {
    return false
  }
}

const serializeInstruction = (instruction: ExecuteSerialInstruction | DeploySerialInstruction) => {
  const instructionAsArray = [
    instruction.p,
    instruction.publicKey,
    instruction.addressType,
    instruction.action,
    instruction.action === 'deploy' ? instruction.bytecodeLocation : instruction.contract,
    instruction.nonce,
    instruction.data,
    instruction.sigType,
  ]
  return RLP.encode(instructionAsArray)
}

const filter = async (contentString: string): Promise<FilteredInstruction | void> => {
  // const content = await getInscriptionContent<Instruction>(inscriptionId)
  let content: Instruction
  try {
    content = JSON.parse(contentString)
  } catch (e) {
    return
  }

  // Verify protocol
  // if (!content.p || content.p !== 'veda') throw new Error('Protocol not match')
  if (!content.p || content.p !== 'veda') return

  // Content Checks
  if (!(
    content.publicKey &&
    content.txHash &&
    content.data &&
    'nonce' in content &&
    content.sig &&
    (content.action === 'execute' || content.action === 'deploy') &&
    (content.addressType && ['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'].includes(content.addressType)) &&
    (content.sigType && ['ecdsa', 'bip-322'].includes(content.sigType))
  )) {
    // throw new Error('Invalid content type')
    return
  }
  if (content.action === 'execute' && content.contract === undefined) {
    // throw new Error('For "execute" action, "contract" key is required.')
    return
  }
  if (content.action === 'deploy' && content.bytecodeLocation === undefined) {
    // throw new Error('For "deploy" action, "bytecodeLocation" key is required.')
    return
  }

  if (typeof content.nonce !== 'number') {
    return
  }

  // Verify transaction hash
  if (content.action === 'execute') {
    const instruction: ExecuteSerialInstruction = {
      p: content.p,
      publicKey: content.publicKey,
      addressType: content.addressType,
      action: content.action,
      contract: content.contract!,
      nonce: content.nonce!,
      data: content.data,
      sigType: content.sigType,
    }
    const calculateHash = keccak256(serializeInstruction(instruction))
    // if (calculateHash !== content.txHash) throw new Error('Invalid transaction hash')
    if (calculateHash !== content.txHash) return
  } else {
    const instruction = {
      p: content.p,
      publicKey: content.publicKey,
      addressType: content.addressType,
      action: content.action,
      bytecodeLocation: content.bytecodeLocation!,
      nonce: content.nonce!,
      data: content.data,
      sigType: content.sigType,
    }
    const calculateHash = keccak256(serializeInstruction(instruction))
    // if (calculateHash !== content.txHash) throw new Error('Invalid transaction hash')
    if (calculateHash !== content.txHash) return
  }

  // Verify sig
  const address = publicKeyToAddress(content.publicKey, process.env.NETWORK as 'mainnet' | 'testnet' || 'mainnet')[content.addressType]
  // if (!(verifyMessage(content.txHash, content.sig, address, content.sigType))) throw new Error('Signature verify failed')
  if (!(verifyMessage(content.txHash, content.sig, address, content.sigType))) return

  return content as FilteredInstruction
}

const sync = async (height: number, lastTimestamp: number, progress: Progress) => {
  const {
    block_count: blockCount,
    inscriptions,
  } = await getBlock(height)
  if (progress.total !== blockCount) progress.total = blockCount

  const transactions: Array<Transaction> = []
  const blockInfo = await bitcoinRpcClient.getBlockInfoByHeight(height)

  for (const inscription of inscriptions) {
    try {
      if (inscription.entry.inscription_number < 0) continue
      const instruction = await filter(inscription.content)
      if (!instruction) continue
      const address = publicKeyToAddress(instruction.publicKey, process.env.NETWORK as 'mainnet' | 'testnet' || 'mainnet')[instruction.addressType || 'p2wpkh']
      const hexAddress = generateHexAddress(address)

      if (instruction.action === 'execute') {
        const transaction = {
          sender: hexAddress,
          to: instruction.contract!,
          nonce: instruction.nonce,
          data: instruction.data,
          txHash: instruction.txHash,
        }
        transactions.push(transaction)
      } else {
        const { bytecode, abi } = await getInscriptionContent<ContractInscription>(instruction.bytecodeLocation!)

        if (!bytecode || typeof bytecode !== 'string' || !abi || !isValidABI(abi)) throw Error('Invalid bytecode or ABI')
        const transaction = {
          sender: hexAddress,
          to: '',
          nonce: instruction.nonce,
          data: bytecode + instruction.data.replace(/^0x/, ''),
          txHash: instruction.txHash,
        }
        transactions.push(transaction)
      }
    } catch (e) {
      console.log(e)
    }
  }
  if (transactions.length !== 0) console.log(transactions)

  const timestamp = blockInfo.time > lastTimestamp ? blockInfo.time : lastTimestamp + 1
  await bvmRpcClient.rpcCall({
    block: {
      blockHash: blockInfo.hash,
      blockNumber: blockInfo.height,
      timestamp,
      mixHash: blockInfo.nonce.toString(16).padStart(64, '0'),
    },
    transactions,
  })
  progress.tick()

  // Next block
  if (height >= blockCount) {
    while (true) {
      const { block_count: newBlockCount } = await getBlock(height)
      if (newBlockCount > blockCount) break
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  sync(height + 1, timestamp, progress)
}

const init = async (height: number, timestamp: number) => {
  const {
    block_count: blockCount,
    // inscriptions,
  } = await getBlock(height)
  console.log('Start sync')
  // Progress
  const progress = new Progress(':bar :current/:total', {
    total: blockCount,
    curr: height - 1,
  })
  progress.tick()
  if (height >= blockCount) {
    while (true) {
      const { block_count: newBlockCount } = await getBlock(height)
      if (newBlockCount > blockCount) break
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
  sync(height + 1, timestamp, progress)
}
export default init