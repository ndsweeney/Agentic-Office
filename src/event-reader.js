const fs = require('node:fs/promises');

class EventReader {
  constructor(file, onEvent) {
    this.file = file;
    this.onEvent = onEvent;
    this.offset = 0;
    this.pending = '';
    this.identity = '';
    this.discarding = false;
    this.busy = false;
  }

  async read() {
    if (this.busy) return;
    this.busy = true;
    let handle;
    try {
      handle = await fs.open(this.file, 'r');
      const stat = await handle.stat();
      const identity = `${stat.dev}:${stat.ino}`;
      if (identity !== this.identity || stat.size < this.offset) {
        this.offset = 0;
        this.pending = '';
        this.discarding = false;
        this.identity = identity;
      }
      // Limit replay to the latest 1 MiB and skip the first partial line.
      if (stat.size - this.offset > 1024 * 1024) {
        this.offset = stat.size - 1024 * 1024;
        this.pending = '';
        this.discarding = true;
      }
      const buffer = Buffer.alloc(Math.min(64 * 1024, stat.size - this.offset));
      if (!buffer.length) return;
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, this.offset);
      this.offset += bytesRead;
      // Retain bytes, not decoded strings, across reads so UTF-8 is not split.
      const bytes = Buffer.concat([Buffer.from(this.pending, 'base64'), buffer.subarray(0, bytesRead)]);
      let start = 0;
      for (let end = bytes.indexOf(10); end !== -1; end = bytes.indexOf(10, start)) {
        if (!this.discarding && end - start <= 16 * 1024) {
          try { this.onEvent(JSON.parse(bytes.subarray(start, end).toString('utf8'))); } catch {}
        }
        this.discarding = false;
        start = end + 1;
      }
      if (bytes.length - start > 16 * 1024) {
        this.pending = '';
        this.discarding = true;
      } else {
        this.pending = bytes.subarray(start).toString('base64');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    } finally {
      await handle?.close();
      this.busy = false;
    }
  }
}

module.exports = { EventReader };
