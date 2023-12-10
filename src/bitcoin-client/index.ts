import axios, { AxiosInstance } from 'axios'

interface ConnectOptions {
  url: string
  user: string
  password: string
}

interface Vout {
  value: number
  n: number
  scriptPubKey: any
}

interface Vin {
  txid?: string
  vout?: number
  scriptSig?: {
    asm: string
    hex: string
  }
  sequence: number
  txinwitness?: string[]
}

interface Transaction {
  txid: string
  hash: string
  version: number
  size: number
  vsize: number
  weight: number
  locktime: number
  vin: Array<Vin>
  vout: Array<Vout>
  hex: string
}

interface Block {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash: string
  nextblockhash: string
  strippedsize: number
  size: number
  weight: number
  tx: Array<string> | Array<Transaction>
}

interface RpcResponse<T> {
  result: T
  error: string | null
  id: string
}

export default class BitcoinRpcClient {
  private _rpcClient: AxiosInstance

  constructor(connectOptions: ConnectOptions) {
    this._rpcClient = axios.create({
      baseURL: connectOptions.url,
      auth: {
        username: connectOptions.user,
        password: connectOptions.password,
      },
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  }

  public getBlockInfo = async (blockHash: string) => {
    try {
      const blockInfoResponse = await this._rpcClient.post<RpcResponse<Block>>('', {
        jsonrpc: '1.0',
        method: 'getblock',
        params: [blockHash],
        id: 'getblock',
      })

      return blockInfoResponse.data.result
    } catch (error) {
      throw error
    }
  }

  public getBlockInfoByHeight = async (blockHeight: number) => {
    try {
      const blockHashResponse = await this._rpcClient.post<RpcResponse<string>>('', {
        jsonrpc: '1.0',
        method: 'getblockhash',
        params: [blockHeight],
        id: 'getblockhash',
      })

      const blockHash = blockHashResponse.data.result

      return this.getBlockInfo(blockHash)
    } catch (error) {
      // console.log(error)
      throw error
    }
  }

  public getBlockCoinbaseByBlockInfo = async (block: Block) => {
    const coinbaseHash = block.tx[0]
    try {
      const txDataResponse = await this._rpcClient.post<RpcResponse<Transaction>>('', {
        method: 'getrawtransaction',
        params: [coinbaseHash, true],
        id: 'getrawtransaction',
      })

      const coinbaseTx = txDataResponse.data.result
      const coinbase = coinbaseTx.vout.reduce((sum, output) => sum + output.value, 0)

      return coinbase
    } catch (error) {
      throw error
    }
  }
}