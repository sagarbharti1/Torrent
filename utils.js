export const chunk = (iterable, chunkSize) =>
  [...Array(Math.ceil(iterable.length / chunkSize)).keys()].map((begin) =>
    iterable.subarray(begin, begin + chunkSize)
  )

export const decodeUint8Array = (uint8Array) => {
  return new TextDecoder('utf-8').decode(uint8Array)
}