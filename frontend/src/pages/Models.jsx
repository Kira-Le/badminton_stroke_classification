import { useState } from 'react'
import { Button } from '../components'

import style from './Models.module.css'

export default function Models() {
    const [subPage, setSubPage] = useState('intro')

    return (
        <>
          <div className={style.intro_box}>
            <h1>Badminton Stroke Classifier</h1>
            <h2>About the classification models</h2>
            <div className={style.button_container}>
                <Button onClick={() => setSubPage('model_a')}>Model A</Button>
                <Button onClick={() => setSubPage('model_b')}>Model B</Button>
                <Button onClick={() => setSubPage('compare_models')}>Compare results</Button>
            </div>
          </div>
          { subPage==='intro' && <div className={style.page}>
            <p>"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."</p>
          </div>
          }
          { subPage==='model_a' && <div className={style.page}>
            <h1>Model A</h1>
            <div className={style.layout}>
                <div className={style.left}>
                    <div className={style.overview}>
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                    </div>
                </div>
                <div className={style.right}>
                Table goes here
                </div>
            </div>
          </div>
          }
           { subPage==='model_b' && <div className={style.page}>
            <h1>Model B</h1>
            <div className={style.layout}>
                <div className={style.left}>
                    <div className={style.overview}>
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                    </div>
                </div>
                <div className={style.right}>
                Table goes here
                </div>
            </div>
          </div>
          }
           { subPage==='compare_models' && <div className={style.page}>
            <h1>Compare results</h1>
            <div className={style.layout}>
                <div className={style.left}>
                    <div className={style.overview}>
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
                    </div>
                </div>
                <div className={style.right}>
                    <table className={style.table}>
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Model A</th>
                                <th>Model B</th>
                            </tr>
                        </thead>
                        <tbody>
                                      
                        </tbody>  
                    </table>
                </div>
            </div>
          </div>
          }
         </>
    )
}