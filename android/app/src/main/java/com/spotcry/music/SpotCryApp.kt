package com.spotcry.music

import android.app.Application
import com.spotcry.music.data.local.AppDatabase

class SpotCryApp : Application() {

    val database: AppDatabase by lazy {
        AppDatabase.getInstance(this)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: SpotCryApp
            private set
    }
}
