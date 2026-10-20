/**
 * 图片的旋转与翻转。
 *
 * ## 为什么用 canvas 而不是纯 CSS
 *
 * CSS 的 `transform: rotate(90deg)` 只改变**显示**，不改变像素：
 * 旋转 90° 后图片的宽高互换，而 CSS 变换后元素占的仍是原来的盒子，
 * 于是要么被裁掉、要么留下大片空白，滚动范围也跟着错。
 * 本项目早先就因为这个原因放弃了用 `transform` 做缩放
 * （见 `ImageViewer.svelte` 里「按真实尺寸布局」的说明）。
 *
 * 这里改成**在 canvas 上真正重绘像素**：得到的是一个新的、尺寸正确的
 * 位图，之后的缩放、适应窗口、滚动全都按正常路径工作，
 * 不需要任何特例。
 *
 * ## 无损与有损
 *
 * 实测（Edge 154，与 WebView2 同版本）：
 *
 *     PNG  往返  rgb(32,64,128) → rgb(32,64,128)   无损
 *     JPEG 往返  rgb(32,64,128) → rgb(30,66,123)   有损
 *
 * 因为重绘像素之后必须重新编码，而 JPEG 是有损格式。
 * 这不是实现缺陷，是格式本身的限制——**因此旋转过的 JPEG
 * 再写回原文件一定会掉画质**，写回前应当提示用户。
 *
 * ## 变换的表示
 *
 * 用「四分之一圈数 + 两个翻转标志」表示，而不是存一个矩阵：
 * 前者是可枚举的有限状态（4 × 2 × 2 = 16 种），便于叠加、复位、
 * 判断是否为「未变换」；矩阵则要处理浮点误差与乘法顺序。
 *
 * ## EXIF 方向：为什么不会双重旋转
 *
 * 带 `Orientation=6` 的 JPEG 实测（Edge 154，与 WebView2 同版本）：
 *
 *     文件里的像素                  40 × 80
 *     <img>.naturalWidth/Height     80 × 40   ← 浏览器已按 EXIF 交换
 *     画到 canvas 后红块位置        右上       ← 方向已应用
 *     canvas 重新编码后             EXIF 段被丢弃
 *
 * 两条结论：
 *
 * 1. **解码时浏览器已经应用了 EXIF 方向**，`naturalWidth/Height` 拿到的是
 *    「摆正之后」的尺寸。我们在此基础上再叠加用户旋转，是先后关系
 *    而非重复，不会转两次。
 * 2. **重新编码会丢掉 EXIF 段**，这恰好等价于 IrfanView 的做法
 *    （改像素的同时把 Orientation 重置为 1）。因此保存回文件后，
 *    别的软件不会再按旧方向转一次——避开了研究里记录的
 *    「混合 EXIF 方向导致双重旋转」那个经典 bug。
 *
 * 代价是 EXIF 的其它信息（相机型号、拍摄时间）也会一并丢失。
 * 这是 canvas 编码的固有限制；要保留就得自己解析并重写 EXIF 段，
 * 对本项目的定位来说不值得。
 */

/** 顺时针四分之一圈数，取值 0..3。 */
export type QuarterTurns = 0 | 1 | 2 | 3;

/** 一次旋转 / 翻转的完整状态。 */
export interface ImageTransform {
  /** 顺时针旋转的四分之一圈数。 */
  turns: QuarterTurns;
  /** 是否水平翻转（左右镜像）。 */
  flipH: boolean;
  /** 是否垂直翻转（上下镜像）。 */
  flipV: boolean;
}

export const IDENTITY: ImageTransform = { turns: 0, flipH: false, flipV: false };

/** 是否处于未变换状态。 */
export function isIdentity(t: ImageTransform): boolean {
  return t.turns === 0 && !t.flipH && !t.flipV;
}

/** 顺时针旋转 90°。 */
export function rotateCW(t: ImageTransform): ImageTransform {
  return { ...t, turns: ((t.turns + 1) % 4) as QuarterTurns };
}

/** 逆时针旋转 90°。 */
export function rotateCCW(t: ImageTransform): ImageTransform {
  return { ...t, turns: ((t.turns + 3) % 4) as QuarterTurns };
}

/**
 * 水平翻转。
 *
 * 注意**翻转与旋转不可交换**：先转后翻和先翻后转结果不同。
 * 这里按用户操作的先后顺序依次施加，因此不做任何归一化，
 * 直接翻转当前状态的标志位即可——canvas 那边会按同样的顺序施加。
 */
export function flipHorizontal(t: ImageTransform): ImageTransform {
  return { ...t, flipH: !t.flipH };
}

/** 垂直翻转。 */
export function flipVertical(t: ImageTransform): ImageTransform {
  return { ...t, flipV: !t.flipV };
}

/**
 * 变换后的尺寸。
 *
 * 只有 90° / 270° 会交换宽高。
 */
export function transformedSize(
  width: number,
  height: number,
  t: ImageTransform,
): { width: number; height: number } {
  return t.turns % 2 === 1 ? { width: height, height: width } : { width, height };
}

/**
 * 把变换施加到一张已解码的图片上，返回新的 canvas。
 *
 * ## 变换顺序
 *
 * 先翻转、再旋转。这与 `flipHorizontal` 等函数「就地翻转标志」的语义
 * 一致：翻转作用在**当前朝向**的图片上，旋转再叠加。
 * 反过来的话，用户点「水平翻转」会看到图片沿旋转后的轴镜像，
 * 与直觉不符。
 *
 * ## 抗锯齿
 *
 * 90° 的整数倍旋转与翻转都是**像素级精确**的，不需要插值。
 * 这里不设置 `imageSmoothingEnabled`，避免某些实现对整数变换也做一次
 * 重采样而引入模糊。
 */
export function applyTransform(
  source: CanvasImageSource,
  width: number,
  height: number,
  t: ImageTransform,
): HTMLCanvasElement {
  const target = transformedSize(width, height, t);

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 整数变换不需要插值；显式关掉以免个别实现仍然重采样
  ctx.imageSmoothingEnabled = false;

  /*
   * 先把原点移到画布中心，所有变换都围绕中心进行。
   * 否则翻转要以画布边缘为轴做两次平移，容易写错。
   */
  ctx.translate(target.width / 2, target.height / 2);

  if (t.flipH) ctx.scale(-1, 1);
  if (t.flipV) ctx.scale(1, -1);
  ctx.rotate((t.turns * Math.PI) / 2);

  ctx.drawImage(source, -width / 2, -height / 2);

  return canvas;
}

/**
 * 图片解码失败。
 *
 * 单独定义一个错误类型而不是抛 `new Error('无法解码图片')`：
 * `reportError` 会优先显示 `err.message`，于是一句中文字符串会出现在
 * 英文界面里。带 `code` 的错误让 UI 边界自己翻译。
 */
export class ImageDecodeError extends Error {
  readonly code = 'image_decode_failed' as const;

  constructor() {
    super('image decode failed');
    this.name = 'ImageDecodeError';
  }
}

/** 把 data URL 解码成可绘制的图片元素。 */
export function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // 用 createElement 而不是 new Image()：后者在部分模块里会被
    // 同名导入遮蔽（见 utils/clipboard.ts 里的同类注释）。
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageDecodeError());
    img.src = dataUrl;
  });
}

/**
 * 按指定 MIME 与质量导出 canvas。
 *
 * `quality` 只对 `image/jpeg` 与 `image/webp` 有效；PNG 会忽略它。
 */
export function encodeCanvas(canvas: HTMLCanvasElement, mime: string, quality = 0.92): string {
  return canvas.toDataURL(mime, quality);
}

/**
 * 可写回的像素上限。
 *
 * 重绘要在 canvas 上铺开整张图：宽 × 高 × 4 字节。8000 × 8000 已达 256 MB，
 * 而 canvas 还会有一份同样大的后备缓冲，因此在重绘之前就该拦住，
 * 而不是等 WebView 被拖垮。与 Rust 侧 `MAX_IMAGE_BYTES` 是两回事——
 * 那个限制的是**压缩后**的文件体积，一张 5 MB 的 PNG 完全可能是 1 亿像素。
 */
export const MAX_TRANSFORM_PIXELS = 64_000_000;

/** 该尺寸是否值得重绘（避免把几百 MB 铺进 canvas）。 */
export function isTransformableSize(width: number, height: number): boolean {
  return width > 0 && height > 0 && width * height <= MAX_TRANSFORM_PIXELS;
}

/**
 * 引擎**实际**能编码的图片格式。
 *
 * ## 为什么必须探测而不是查表
 *
 * `canvas.toDataURL(type)` 对无法编码的 `type` **不报错**，而是静默退回
 * `image/png`。实测 WebView2（Edge 同版本）：
 *
 *     image/gif / image/bmp / image/x-icon / image/avif  ->  data:image/png;base64,...
 *
 * 因此「支持哪些格式」这件事只能问引擎本身。用一张 1 × 1 的画布探一次
 * 并缓存结果：探测是 O(1) 且只跑一次，比维护一张会随引擎版本过期的表可靠。
 *
 * 判据是编码结果自称的 MIME 与请求的是否一致——不一致即说明它退回了 PNG。
 */
let encodableCache: ReadonlySet<string> | null = null;

/** 候选格式。与 `lang_map::image_mime` 认得的格式保持一致。 */
const PROBE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-icon',
  'image/avif',
] as const;

/** 探测一次并缓存引擎支持的编码格式。 */
export function encodableMimes(): ReadonlySet<string> {
  if (encodableCache) return encodableCache;

  const found = new Set<string>();
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    for (const mime of PROBE_MIMES) {
      if (probe.toDataURL(mime).startsWith(`data:${mime}`)) found.add(mime);
    }
  } catch {
    // 探测失败（无 DOM 环境）时保守认为只能写 PNG
    found.add('image/png');
  }

  encodableCache = found;
  return found;
}

/** 该格式能否原格式写回。不能则重绘结果无法保存，须提前告知用户。 */
export function canWriteBackAs(mime: string): boolean {
  return encodableMimes().has(mime);
}
