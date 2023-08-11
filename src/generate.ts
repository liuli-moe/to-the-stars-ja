import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import { parse } from 'node-html-parser'
import { AsyncArray, asyncLimiting } from '@liuli-util/async'

function html2md(html: string) {
  return unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRemark)
    .use(remarkStringify)
    .processSync(html)
    .toString()
}

function formatNumber(num: number, width: number) {
  const numStr = num.toString()
  const padding = Math.max(0, width - numStr.length)
  return '0'.repeat(padding) + numStr
}

async function generate() {
  const text = await readFile(path.resolve(__dirname, './To_the_Stars_by_Hieronym-1UfctSP6.html'), 'utf-8')
  const dom = parse(text)
  const sections = (dom.querySelectorAll('#contents-list > ol > li > a') as unknown as HTMLLinkElement[]).map((it) => ({
    id: it.getAttribute('href'),
    title: it.textContent,
  }))
  // console.log(sections)
  const distPath = path.resolve(__dirname, '.temp')
  await mkdir(distPath, { recursive: true })
  await AsyncArray.forEach(
    sections,
    asyncLimiting(async (it, i) => {
      console.log(it.title)
      const li = dom.querySelector(it.id)
      li.querySelector('.chapter_nav').remove()
      li.querySelector('h2').remove()
      const md = `# ${it.title}\n\n` + html2md(li.outerHTML)
      await writeFile(path.resolve(distPath, `${formatNumber(i + 1, 3)}.md`), md)
    }, 1),
  )
}

generate()
