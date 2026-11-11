export default function Image({unoptimized,fill,priority, ...props}: any){return <img {...props} style={{...(fill?{width:'100%',height:'100%',objectFit:'cover'}:{}),...props.style}}/>}
