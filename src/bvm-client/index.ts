import axios, { AxiosInstance } from 'axios'

interface JsonRpcRequest {
  jsonrpc: string
  method: string
  params: Array<any>
  id: number
}

interface JsonRpcResponse<T = any> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: any
  }
}

interface Block {
  blockHash: string
  blockNumber: number
  timestamp: number
  mixHash: string
}

interface LatestBlock {
  veda_block_hash: string
  veda_block_number: number
  veda_timestamp: number
}

export interface Transaction {
  sender: string
  to: string
  nonce: number
  data: string
  txHash: string
}

type BlockWithTransactions = [Block, Array<Transaction>]

interface OriginData {
  block: Block,
  transactions: Array<Transaction>
}

export default class BvmRpcClient {
  private _rpcClient: AxiosInstance
  private _rpcId: number = 0

  constructor(baseURL: string) {
    this._rpcClient = axios.create({
      baseURL,
    })
  }

  private _rpcCall = async <R, T extends any[]>(method: string, params: T) => {
    const requestData: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: method,
      params,
      id: this._rpcId,
    }

    const response = await this._rpcClient.post<JsonRpcResponse<R>>('', requestData)
    if (response.data.error) {
      throw Error(`JSON-RPC Error: ${response.data.error}`)
    }
    return response.data
  }

  public rpcCall = async (params: OriginData) => {
    await this._rpcCall<null, BlockWithTransactions>('sync', [params.block, params.transactions])
  }
  public getSyncInfo = async () => {
    return await this._rpcCall<LatestBlock, Array<null>>('get_latest_block', [])
  }
}