import RadioButton from './RadioButton'

const RadioButtonGroup = ({ label, options = [], onChange, name }) => {
  function renderOptions() {
    return options.map((option, index) => {
      const shortenedOptionLabel = option.replace(/\s+/g, "");
      const optionId = `radio-option-${shortenedOptionLabel}`;

      return (
        <RadioButton
          value={option}
          label={option}
          key={optionId}
          id={optionId}
          name={name}
          defaultChecked={index === 0}
          onChange={onChange}
        />
      )
    })
  }
  return (
    <fieldset>
      <legend>{label}</legend>
      <div>{renderOptions()}</div>
    </fieldset>
  )
}

export default RadioButtonGroup;