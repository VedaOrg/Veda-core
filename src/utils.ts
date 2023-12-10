
import { setTimeout as timersSetTimeout } from 'timers/promises'

interface Async<T = any> {
  (): Promise<T>
}

export const sleep = (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time))
}

export const retry = async <T = any>(fn: Async<T>, config: {
  delay: number,
  printError: boolean,
  errorHandler?: (e: any) => boolean,
}): Promise<T | any> => {
  const { delay, printError, errorHandler } = config
  let success = false
  let revert = false
  let result: T
  while (!success) {
    try {
      result = await fn()
      success = true
      return result
    } catch (e) {
      if (printError && e) console.error(e)
      if (errorHandler) revert = errorHandler(e)
      if (revert) {
        throw e
      }
    }
    await sleep(delay)
  }
}

export const autoRetry = async <T = any>(fn: Async<T>, config: {
  delay?: number,
  printError?: boolean,
  timeout?: number,
  errorHandler?: (e: any) => boolean,
} = {
    delay: 1000,
    printError: false,
    timeout: 30000,
  }): Promise<T> => {
  const { timeout, delay, printError, errorHandler } = config
  return retry<T>(
    () => new Promise((resolve, reject) => {
      fn().then(resolve, reject)
      if (timeout !== 0) timersSetTimeout(timeout || 30000).then(reject)
    }),
    {
      delay: delay || 1000,
      printError: printError || false,
      errorHandler,
    }
  )
}