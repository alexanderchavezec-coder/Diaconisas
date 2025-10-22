"""Simple cache for Google Sheets to avoid API quota limits"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class SheetsCache:
    def __init__(self, cache_duration_seconds: int = 30):
        self.cache: Dict[str, Dict] = {}
        self.cache_duration = timedelta(seconds=cache_duration_seconds)
    
    def get(self, sheet_name: str) -> Optional[List[Dict]]:
        """Get cached data if available and not expired"""
        if sheet_name in self.cache:
            cached_data = self.cache[sheet_name]
            if datetime.now() - cached_data['timestamp'] < self.cache_duration:
                return cached_data['data']
        return None
    
    def set(self, sheet_name: str, data: List[Dict]):
        """Cache data with timestamp"""
        self.cache[sheet_name] = {
            'data': data,
            'timestamp': datetime.now()
        }
    
    def invalidate(self, sheet_name: str):
        """Remove cached data for a sheet"""
        if sheet_name in self.cache:
            del self.cache[sheet_name]
    
    def clear(self):
        """Clear all cache"""
        self.cache.clear()

# Global cache instance
sheets_cache = SheetsCache(cache_duration_seconds=30)
