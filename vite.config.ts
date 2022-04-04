import {defineConfig} from 'vite'
import {resolve} from 'path'

export default defineConfig({
    resolve: {
        alias: {
            'core': resolve(__dirname, 'src/core/')
        }
    }
})