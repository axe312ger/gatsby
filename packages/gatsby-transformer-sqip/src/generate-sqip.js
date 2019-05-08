const crypto = require(`crypto`)
const { resolve, parse } = require(`path`)

const Debug = require(`debug`)
const { exists, readFile, writeFile } = require(`fs-extra`)
const svgToMiniDataURI = require(`mini-svg-data-uri`)
const PQueue = require(`p-queue`)
const sqip = require(`sqip`)

const queue = new PQueue({ concurrency: 1 })
const debug = Debug(`gatsby-transformer-sqip`)

module.exports = async function generateSqip(options) {
  const {
    cache,
    absolutePath,
    numberOfPrimitives,
    blur,
    mode,
    cacheDir,
    contentDigest,
  } = options

  const { name } = parse(absolutePath)

  const sqipOptions = {
    numberOfPrimitives,
    blur,
    mode,
  }

  const optionsHash = crypto
    .createHash(`md5`)
    .update(JSON.stringify(sqipOptions))
    .digest(`hex`)

  const cacheKey = `${contentDigest}-${optionsHash}`
  const cachePath = resolve(cacheDir, `${contentDigest}-${optionsHash}.svg`)

  debug(
    `Request preview generation for ${name} (${contentDigest}-${optionsHash})`
  )

  return queue.add(async () => {
    let primitiveData = await cache.get(cacheKey)

    debug(
      `Executing preview generation request for ${name} (${contentDigest}-${optionsHash})`
    )

    if (!primitiveData) {
      let svg

      if (await exists(cachePath)) {
        debug(
          `Primitive result file already exists for ${name} (${contentDigest}-${optionsHash})`
        )
        const svgBuffer = await readFile(cachePath)
        svg = svgBuffer.toString()
      } else {
        debug(
          `Generate primitive result file of ${name} (${contentDigest}-${optionsHash})`
        )

        const result = await new Promise((resolve, reject) => {
          try {
            const result = sqip({
              filename: absolutePath,
              ...sqipOptions,
            })
            resolve(result)
          } catch (error) {
            reject(error)
          }
        })

        svg = result.final_svg

        await writeFile(cachePath, svg)
        debug(
          `Wrote primitive result file to disk for ${name} (${contentDigest}-${optionsHash})`
        )
      }

      primitiveData = {
        svg,
        dataURI: svgToMiniDataURI(svg),
      }

      await cache.set(cacheKey, primitiveData)
    } else {
      debug(`Cache found for ${name}-${optionsHash}`)
    }

    return primitiveData
  })
}
