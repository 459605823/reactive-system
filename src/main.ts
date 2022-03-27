import {effect} from './core/effect'
import {reactive} from './core/reactive'

const obj = [1]
const arr = reactive(obj)

effect(() => {
  for(let key of arr) {
    console.log(key)
  }
})

setTimeout(() => {
  arr[1] = 2
}, 2000)


