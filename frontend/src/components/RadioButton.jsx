// Source: https://codesandbox.io/p/sandbox/custom-radio-button-group-cu5f4l?file=%2Fsrc%2Fcomponents%2Finputs%2FRadioButton.tsx

import style from './RadioButton.module.css'

const RadioButton = ({ label, id, ...rest }) => (
    <div>
      <input
      type="radio"
      id={id}
      {...rest}
      />
      <label
      htmlFor={id}
      className={style.radioLabel}
      >
        {label}
      </label>
    </div>  
)

export default RadioButton