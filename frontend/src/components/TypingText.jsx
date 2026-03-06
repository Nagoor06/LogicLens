import { useEffect, useState } from "react"

function TypingText({ text }) {

const [display,setDisplay] = useState("")

useEffect(()=>{

let i = 0

setDisplay("")

const interval = setInterval(()=>{

i++

setDisplay(text.slice(0,i))

if(i>=text.length){
clearInterval(interval)
}

},4)

return ()=>clearInterval(interval)

},[text])

return(

<div className="whitespace-pre-wrap font-mono text-sm">

{display}

</div>

)

}

export default TypingText