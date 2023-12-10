import Progress from 'progress'

class DynamicProgressBar {
  private bar: ProgressBar
  private currentTick: number = 0

  constructor() {
    this.bar = new Progress(':bar :percent', { total: 100, width: 20 })
  }

  public setTotal = (total: number) => {
    this.bar.total = total
  }

  public tick = () => {
    this.currentTick++
    if (this.currentTick <= this.bar.total) {
      this.bar.tick()
    }
  }
}

export default DynamicProgressBar