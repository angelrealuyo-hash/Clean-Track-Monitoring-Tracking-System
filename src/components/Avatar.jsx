import AuthImage from './AuthImage.jsx'

// A person's picture, or their initials when there is none.
// className: the existing avatar style ('ct-avatar', 'admin-avatar', …).
export default function Avatar({ photo, initials, name, className = 'ct-avatar', style }) {
  if (!photo)
    return (
      <span className={className} style={style} aria-hidden={name ? undefined : 'true'} title={name}>
        {initials}
      </span>
    )
  return (
    <span className={`${className} ct-avatar-photo`} style={style} title={name}>
      <AuthImage src={photo} alt={name ? `${name}'s picture` : 'Profile picture'} compactError />
    </span>
  )
}
