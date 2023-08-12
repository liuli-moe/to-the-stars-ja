import { readFile, writeFile, readdir } from 'fs/promises'
import path from 'path'
import { CharacterTextSplitter, RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage, SystemMessage } from 'langchain/schema'
import { AsyncArray, asyncLimiting } from '@liuli-util/async'
import { pathExists } from 'fs-extra'
import { encode } from 'gpt-3-encoder'

class TextSplitterWithTokenize extends TextSplitter {
  constructor(
    private readonly options: {
      chunkTokenSize: number
    },
  ) {
    super()
  }

  async splitText(text: string): Promise<string[]> {
    const list = text.split('\n')
    let temp = ''
    const r: string[] = []

    for (const it of list) {
      const t = temp + (temp === '' ? '' : '\n') + it
      if (encode(t).length > this.options.chunkTokenSize) {
        r.push(temp)
        temp = it
      } else {
        temp = t
      }
    }
    if (temp !== '') {
      r.push(temp)
    }
    return r
  }
}

const TRANSLATE_PROMPT = `
Please translate the English novel below into Japanese.
Some proper nouns are listed below, please observe the following translations:
English: Japanese
God does not play dice with the universe. 神はサイコロを振らない
`.trim()

async function translate() {
  const splitter = new TextSplitterWithTokenize({
    chunkTokenSize: 1000,
  })
  const chat = new ChatOpenAI({ temperature: 0 })

  const names = await readdir(path.resolve(__dirname, '../books/en-US'))

  for (const it of names) {
    const sourcePath = path.resolve(__dirname, '../books/en-US', it)
    const distPath = path.resolve(__dirname, '../books/ja-JP', it)
    if (await pathExists(distPath)) {
      console.log(`skip ${it}`)
      continue
    }
    const text = await readFile(sourcePath, 'utf-8')
    const list = await splitter.splitText(text)
    console.log(`section ${it}, count: ${list.length}`)
    const r = (
      await AsyncArray.map(
        list,
        asyncLimiting(async (it, i) => {
          console.log(`process ${i + 1}/${list.length}`)
          return (await chat.call([new SystemMessage(TRANSLATE_PROMPT), new HumanMessage(it)])).content
        }, 10),
      )
    ).join('\n\n')
    await writeFile(distPath, r)
  }
}

translate()
