import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Locally stored media, as an app-relative path.
 *
 * Retained from the original rule, which only ever matched these forms.
 */
const LOCAL_MEDIA_PATTERN = /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/;

const readEnv = (name: string): string => (process.env[name] || '').trim().replace(/\/+$/, '');

/**
 * The public bases this application serves uploads from.
 *
 * `S3_PUBLIC_URL` is what the presigned uploader hands back to the browser, and every product,
 * course and academy image stored since the move to S3 is one of these absolute URLs. The
 * validator only ever widened to those exact bases — it deliberately does not accept any
 * `https://` host, because `stripExternalMedia` exists to stop lesson content pointing at
 * third-party or hostile origins, and a blanket "any absolute URL is fine" rule would undo
 * that protection across courses, lessons and series alike.
 */
function isOwnS3Url(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.username || parsed.password) return false;

  const candidates: string[] = [];
  const publicUrl = readEnv('S3_PUBLIC_URL');
  const endpoint = readEnv('S3_ENDPOINT');
  const bucket = readEnv('S3_BUCKET');
  const mediaBucket = readEnv('S3_MEDIA_BUCKET');
  if (publicUrl) candidates.push(publicUrl);
  if (endpoint && bucket) candidates.push(`${endpoint}/${bucket}`);
  if (endpoint && mediaBucket) candidates.push(`${endpoint}/${mediaBucket}`);

  // Compare on the full prefix including the path, so a bucket cannot be pointed at by
  // `https://evil.example/<same-host>` style confusion: the host must match as well as the
  // path prefix.
  return candidates.some((base) => {
    if (!base) return false;
    if (value.startsWith(`${base}/`)) return true;
    try {
      const baseParsed = new URL(base);
      return (
        baseParsed.host === parsed.host &&
        parsed.pathname.startsWith(`${baseParsed.pathname.replace(/\/+$/, '')}/`)
      );
    } catch {
      return false;
    }
  });
}

/**
 * True when a media reference points at a file this application uploaded.
 *
 * Empty is allowed so that clearing an optional thumbnail does not require sending `null`.
 */
export function isUploadedMediaRef(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return true;
  if (LOCAL_MEDIA_PATTERN.test(value)) return true;
  return isOwnS3Url(value);
}

@ValidatorConstraint({ name: 'uploadedMediaUrl', async: false })
class UploadedMediaUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isUploadedMediaRef(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return (
      `${args.property} must be a file uploaded to this workspace — either an app-relative ` +
      `upload path or a URL on this deployment's own storage`
    );
  }
}

/**
 * Validates that a media URL was produced by this application's uploader.
 *
 * The previous rule was a bare `@Matches(/^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)\.+$/)`
 * that only accepted app-relative paths. Once uploads moved to S3 the uploader returned an
 * absolute `https://<project>.supabase.co/storage/v1/object/public/uploads/...` URL, so
 * every course save carrying a freshly uploaded thumbnail was rejected by the API with the
 * raw regex as the error — after the file had already been uploaded successfully.
 */
export function IsUploadedMediaUrl(validationOptions?: ValidationOptions) {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: UploadedMediaUrlConstraint,
    });
  };
}