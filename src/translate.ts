import { readFile, writeFile, readdir } from 'fs/promises'
import path from 'path'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HumanMessage, SystemMessage } from 'langchain/schema'
import { AsyncArray, asyncLimiting } from '@liuli-util/async'
import { pathExists } from 'fs-extra'

const TRANSLATE_PROMPT = `
Translate the following excerpt from an English novel into Japanese. Ensure that the translation accurately captures the tone and nuances of the original text.
Please note that this translation project has been undertaken with the proper permissions and authorization, and complies with all relevant legal and copyright requirements.
`.trim()

async function translate() {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
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
