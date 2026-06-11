from .base import BaseConnector
from .amazon import AmazonConnector

def get_connector(url: str) -> BaseConnector:
    url_lower = url.lower()
    if "amazon." in url_lower:
        return AmazonConnector()
    
    # Generic fallback
    from .base import ConnectorResult
    class GenericConnector(BaseConnector):
        async def scrape(self, url: str) -> ConnectorResult:
            return ConnectorResult(status="error", block_reason="Generic connector not fully implemented")
            
    return GenericConnector()
