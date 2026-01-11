from .pull_all import pull_all as _real_pull_all

__all__ = ["pull_all"]


def pull_all(*args, **kwargs):
    """Wrapper that calls the canonical `pull_all` implementation in `pull_all.py`.

    Keeps compatibility for callers that import `scripts.pull_data.pull_all`.
    """
    return _real_pull_all(*args, **kwargs)


if __name__ == "__main__":
    _real_pull_all()
