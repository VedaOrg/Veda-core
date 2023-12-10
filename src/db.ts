import { Level } from 'level'
import { join } from 'path'

export default new Level(process.env.DB_PATH || join(__dirname, '..', 'veda-db'))