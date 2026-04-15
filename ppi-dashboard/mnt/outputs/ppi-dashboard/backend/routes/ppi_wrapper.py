import os
from ppi_client.ppi import PPI

_ppi: PPI | None = None


def get_ppi() -> PPI:
    global _ppi
    if _ppi is None:
        ppi = PPI(sandbox=False)
        ppi.account.login_api(
            os.environ["PPI_API_KEY"],
            os.environ["PPI_API_SECRET"],
        )
        _ppi = ppi
    return _ppi


ACCOUNT = os.environ.get("PPI_ACCOUNT_NUMBER", "")
