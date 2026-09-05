declare const worker: {
	fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};
export default worker;
