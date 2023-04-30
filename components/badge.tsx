export default function Badge({children}) {

    return (
        <div className={"rounded-full inline-flex text-sm bg-orange-700 bg-opacity-10 w-fit text-orange-400 px-2 py-0.5"}>
            <p>{children}</p>
        </div>
    )
}
