const timeout = async delay => new Promise(resolve => setTimeout(resolve, delay, delay));

export default timeout;
