import style from './Button.module.css'

export default function Button ({ variant, ...rest}) {
    return (
    <button
    className={`${style.button} ${variant ? style[variant] : ''}`}
    {...rest}
    />
  )
}