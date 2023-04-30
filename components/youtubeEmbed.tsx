export default function YoutubeEmbed({id}){
    return (
        <div className={"my-4"}>
            <iframe className={"w-full"} height={"315"} src={`https://www.youtube.com/embed/${id}`}  title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen></iframe>
        </div>
    )
}