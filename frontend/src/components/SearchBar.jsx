// Source: Create a React search component in 8 minutes https://youtu.be/M9jJw_xn79U
// https://tomdekan.com/articles/react-search-bar?ref=ty

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Mic } from 'lucide-react'

import style from './SearchBar.module.css' // Generated with claude.ai based on tailwinds styling from Search Bar example referenced above

//TODO: Remove below sampleData when connected to API
const sampleData = [
  {
    id: 1,
    title: 'Kento_MOMOTA_CHOU_Tien_Chen_Fuzhou_Open_2019_Finals',
  },
  {
    id: 2,
    title: 'CHEN_Long_CHOU_Tien_Chen_World_Tour_Finals_Group_Stage',
  },
  {
    id: 3,
    title: 'Kento_MOMOTA_CHOU_Tien_Chen_KOREA_OPEN_2019_Final',
  },
  {
    id: 4,
    title: 'CHEN_Long_CHOU_Tien_Chen_Denmark_Open_2019_QuarterFinal',
  },
  {
    id: 5,
    title: 'Kento_MOMOTA_CHOU_Tien_Chen_Fuzhou_Open_2018_Finals',
  },
]
// End of sampleData to be removed

const SearchBar = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const navigate = useNavigate()

    const debounce = (func, delay) => {
        let timeoutId
        return (...args) => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => func(...args), delay)
        }
    }

    const handleSearch = useCallback(
        debounce((term) => {
            if (term.trim() === '') {
                setSearchResults([])
            } else {
                const results = sampleData.filter((item) =>
                    item.title.toLowerCase().includes(term.toLowerCase()),
                )
                setSearchResults(results)
            }
        }, 300),
        [],
    )

    useEffect(() => {
        handleSearch(searchTerm)
    }, [searchTerm, handleSearch])

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value)
    }

    return (
        <div className={style.wrapper}>
            <form
            onSubmit={(e) => e.preventDefault()}
            className={style.form}
            >
                <div className={style.inputWrapper}>
                    <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    className={style.input}
                    placeholder="Search by player or tournament name"
                    />
                    <div className={style.buttons}>
                        <button
                        type="button"
                        className={style.micButton}
                        onClick={() =>
                            alert(
                                'Voice search feature not yet implemented!',
                            )
                        }
                        >
                            <Mic size={20} />{' '}
                        </button>{' '}
                        <button type="submit" className={style.searchButton}>
                            <Search size={20} />{' '}
                        </button>{' '}
                    </div>{' '}
                </div>{' '}
            </form>{' '}
            {searchResults.length > 0 && (
                <div className={style.results}>
                    <h2 className={style.resultsHeading}> Search Results: </h2>{' '}
                    <ul className={style.resultsList}>
                        {' '}
                        {searchResults.map((result) => (
                            <li key={result.id} className={style.resultsItem}>
                                <a
                                href={result.url}
                                className={style.resultsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigate("/analysis")}
                                >
                                    {' '}
                                    {result.title}{' '}
                                </a>{' '}
                            </li>
                        ))}{' '}
                    </ul>{' '}
                </div>
            )}{' '}
    </div>
  )
}

export default SearchBar