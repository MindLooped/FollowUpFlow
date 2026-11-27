class ValidationError(ValueError):
    def __init__(self, details: dict[str, str] | str):
        if isinstance(details, str):
            details = {"error": details}
        self.details = details
        super().__init__(next(iter(details.values())))


class NotFoundError(LookupError):
    pass
