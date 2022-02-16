# Generated by Django 3.0.11 on 2022-02-16 17:16

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('racetime', '0056_auto_20210815_1823'),
    ]

    operations = [
        migrations.RenameField(
            model_name='race',
            old_name='info',
            new_name='info_user',
        ),
        migrations.AlterField(
            model_name='race',
            name='info_user',
            field=models.TextField(blank=True, help_text='Any useful information for race entrants (e.g. randomizer seed).', max_length=1000, null=True, verbose_name='Info'),
        ),
        migrations.AddField(
            model_name='race',
            name='info_bot',
            field=models.TextField(blank=True, max_length=1000, null=True, verbose_name='Info (bot-supplied)'),
        ),
    ]
