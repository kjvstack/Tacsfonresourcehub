module.exports = (req, res, next) => {

    if (req.user.role !== "Executive") {

        return res.status(403).send(`
            <h2>Access Denied ❌</h2>
            <p>Executive access only.</p>
        `);

    }

    next();

};