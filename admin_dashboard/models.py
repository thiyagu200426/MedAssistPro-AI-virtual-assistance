from django.db import models

class ChatAnalytics(models.Model):
    date = models.DateField(unique=True)
    total_conversations = models.IntegerField(default=0)
    total_messages = models.IntegerField(default=0)
    emergency_detections = models.IntegerField(default=0)
    active_users = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Analytics for {self.date}"

    class Meta:
        db_table = 'chat_analytics'
        ordering = ['-date']
