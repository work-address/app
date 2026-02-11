import {injectable} from 'inversify';
import sharp from 'sharp';
import {Readable} from 'stream';

@injectable()
export class ImageResizer {
  public async resize(
    imageBase64: string,
    width: number
  ): Promise<string> {
    const bufferIn = Buffer.from(imageBase64, 'base64');
    const bufferOut = await sharp(bufferIn).resize(width).grayscale().webp({quality: 50}).toBuffer();
    
    const stream = new Readable();
    stream.push(bufferOut);
    stream.push(null);
    const base64output = stream.read().toString('base64')

    return base64output;
  }
}
