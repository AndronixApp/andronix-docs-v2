export default function YoutubeEmbed({ id }: { id: string }) {
    return (
        <div className={"my-5 overflow-hidden"} style={{ borderRadius: "var(--andronix-radius-card)", background: "var(--andronix-code-bg)" }}>
            <iframe className={"block aspect-video w-full"} src={`https://www.youtube.com/embed/${id}`}  title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen></iframe>
        </div>
    )
}